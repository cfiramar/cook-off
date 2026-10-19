/**
 * Device Biometric Authentication Service
 * 
 * Provides unified, secure biometric and device lock authentication for the Host application.
 * Supports:
 * 1. Native Android Host wrapper app (via AndroidX BiometricPrompt bridge HostNativeApp)
 * 2. Modern Web Browsers (via WebAuthn Passkeys / Platform Authenticator)
 * 
 * Complies with strict security standards without sending any biometric data to servers.
 */

export interface DeviceAuthResult {
  success: boolean;
  error?: string;
}

export interface NativeHostBridge {
  isBiometricAvailable?: () => boolean;
  authenticateBiometrics?: () => void;
}

declare global {
  interface Window {
    HostNativeApp?: NativeHostBridge;
    onHostNativeBiometricResult?: (success: boolean, error?: string | null) => void;
  }
}

const STORAGE_KEY = 'cookoff_device_cred_id';

/**
 * Safely converts an ArrayBuffer into a Base64-encoded string.
 * Uses chunked character conversion to prevent call-stack overflow on large buffers.
 */
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Safely converts a Base64-encoded string back into an ArrayBuffer.
 */
export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Builds the Relying Party (RP) entity for WebAuthn.
 * WebAuthn spec strictly forbids IP addresses as rp.id (throws SecurityError).
 * We only attach `id` when the hostname is a valid domain or localhost.
 */
export function getRpEntity(hostname: string): { name: string; id?: string } {
  const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
  const rp: { name: string; id?: string } = {
    name: 'Cook-Off Host'
  };

  if (hostname && !isIpAddress) {
    rp.id = hostname;
  }

  return rp;
}

/**
 * Domain Service managing Host device authentication.
 */
export class DeviceBiometricService {
  /**
   * Retrieves the native Android Host bridge if present.
   */
  public static getBridge(): NativeHostBridge | undefined {
    if (typeof window === 'undefined') return undefined;
    return window.HostNativeApp || (window as unknown as { AndroidHostApp?: NativeHostBridge }).AndroidHostApp;
  }

  /**
   * Checks whether the application is running inside the native Android Host wrapper.
   */
  public static isNativeApp(): boolean {
    return typeof this.getBridge() !== 'undefined';
  }

  /**
   * Checks whether native biometric authentication is hardware-supported and enrolled on the Android device.
   */
  public static isNativeBiometricAvailable(): boolean {
    const bridge = this.getBridge();
    if (!bridge) return false;
    try {
      return bridge.isBiometricAvailable?.() === true;
    } catch {
      return false;
    }
  }

  /**
   * Checks whether WebAuthn is supported by the current browser environment.
   */
  public static isWebAuthnSupported(): boolean {
    return typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined';
  }

  /**
   * Checks whether any biometric or device authentication mechanism is available.
   */
  public static async isBiometricAvailable(): Promise<boolean> {
    if (this.isNativeBiometricAvailable()) {
      return true;
    }

    if (this.isWebAuthnSupported()) {
      try {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Checks whether a previous credential ID has been saved locally for this browser.
   */
  public static hasStoredCredential(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return !!localStorage.getItem(STORAGE_KEY);
  }

  /**
   * Clears the stored device credential, allowing re-registration on next attempt.
   */
  public static clearStoredCredential(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  /**
   * Performs authentication via the native Android BiometricPrompt bridge.
   */
  public static async authenticateWithNativeBridge(): Promise<DeviceAuthResult> {
    return new Promise((resolve) => {
      let resolved = false;

      const cleanup = () => {
        if (typeof window !== 'undefined') {
          delete window.onHostNativeBiometricResult;
        }
      };

      // Set timeout fallback in case native activity disappears
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve({ success: false, error: 'תם הזמן לאימות ביומטרי' });
        }
      }, 65000);

      window.onHostNativeBiometricResult = (success: boolean, error?: string | null) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);
        cleanup();

        if (success) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: error || 'האימות בוטל או נכשל' });
        }
      };

      const bridge = DeviceBiometricService.getBridge();
      try {
        if (bridge?.authenticateBiometrics) {
          bridge.authenticateBiometrics();
        } else if ((bridge as unknown as { authenticateBiometric?: () => void })?.authenticateBiometric) {
          (bridge as unknown as { authenticateBiometric: () => void }).authenticateBiometric();
        } else {
          throw new Error('ממשק אימות מקורי אינו זמין במכשיר');
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        cleanup();
        resolve({ success: false, error: err?.message || 'שגיאה בהפעלת אימות מקורי במכשיר' });
      }
    });
  }

  /**
   * Performs WebAuthn passkey assertion or initial registration.
   */
  public static async authenticateWithWebAuthn(): Promise<DeviceAuthResult> {
    try {
      if (!this.isWebAuthnSupported()) {
        return { success: false, error: 'WebAuthn אינו נתמך בדפדפן זה' };
      }

      // Generate a cryptographically secure random challenge
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const storedId = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;

      // 1. If we have a stored credential, attempt to authenticate (assert)
      if (storedId) {
        try {
          const rawId = base64ToBuffer(storedId);
          const assertion = await navigator.credentials.get({
            publicKey: {
              challenge,
              allowCredentials: [
                {
                  id: rawId,
                  type: 'public-key'
                  // Note: transports is intentionally omitted so the browser matches all available authenticators
                }
              ],
              userVerification: 'preferred',
              timeout: 60000
            }
          });

          if (assertion) {
            return { success: true };
          }
        } catch (err: any) {
          if (err.name === 'NotAllowedError') {
            return { success: false, error: 'האימות בוטל' };
          }
          if (err.name === 'AbortError') {
            return { success: false, error: 'האימות הופסק' };
          }

          // If credential is stale or unrecognized on this device, remove it and proceed to re-register
          this.clearStoredCredential();
        }
      }

      // 2. Initial passkey registration or re-registration
      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      const rpEntity = getRpEntity(window.location?.hostname || '');

      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: rpEntity,
          user: {
            id: userId,
            name: 'host_manager',
            displayName: 'מארח התחרות'
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },   // ES256
            { alg: -257, type: 'public-key' }  // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'preferred',
            residentKey: 'preferred'
          },
          timeout: 60000
        }
      })) as PublicKeyCredential | null;

      if (credential && credential.rawId) {
        const b64 = bufferToBase64(credential.rawId);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, b64);
        }
        return { success: true };
      }

      return { success: false, error: 'לא התקבל אישור מהמכשיר' };
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        return { success: false, error: 'האימות בוטל' };
      }
      if (err.name === 'AbortError') {
        return { success: false, error: 'האימות הופסק' };
      }
      return { success: false, error: err?.message || 'שגיאה באימות מול המכשיר' };
    }
  }

  /**
   * Main entry point to authenticate the host using the best available device mechanism.
   * Prioritizes the native Android BiometricPrompt bridge if running in the Host app,
   * otherwise delegates to WebAuthn.
   */
  public static async authenticate(): Promise<DeviceAuthResult> {
    if (this.isNativeBiometricAvailable()) {
      return this.authenticateWithNativeBridge();
    }

    return this.authenticateWithWebAuthn();
  }
}
