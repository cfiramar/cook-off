import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  DeviceBiometricService,
  bufferToBase64,
  base64ToBuffer,
  getRpEntity
} from './deviceBiometricsAuth.ts';

describe('DeviceBiometricService unit tests', () => {
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    (globalThis as any).localStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      }
    };
    (globalThis as any).window = {
      location: { hostname: 'cook-off-contest.web.app' }
    };
  });

  describe('Base64 and ArrayBuffer utilities', () => {
    it('round-trips binary buffers to Base64 and back', () => {
      const original = new Uint8Array([0, 1, 2, 127, 128, 255, 42, 99]);
      const b64 = bufferToBase64(original.buffer);
      const restored = new Uint8Array(base64ToBuffer(b64));
      assert.deepEqual(Array.from(restored), Array.from(original));
    });
  });

  describe('getRpEntity', () => {
    it('includes id for standard domains', () => {
      const rp = getRpEntity('cook-off-contest.web.app');
      assert.equal(rp.name, 'Cook-Off Host');
      assert.equal(rp.id, 'cook-off-contest.web.app');
    });

    it('includes id for localhost', () => {
      const rp = getRpEntity('localhost');
      assert.equal(rp.name, 'Cook-Off Host');
      assert.equal(rp.id, 'localhost');
    });

    it('omits id for IPv4 addresses to avoid WebAuthn SecurityError', () => {
      const rp = getRpEntity('192.168.1.55');
      assert.equal(rp.name, 'Cook-Off Host');
      assert.equal(rp.id, undefined);
    });
  });

  describe('Credential storage operations', () => {
    it('checks and clears stored credentials correctly', () => {
      assert.equal(DeviceBiometricService.hasStoredCredential(), false);
      mockStorage['cookoff_device_cred_id'] = 'mock-b64-id';
      assert.equal(DeviceBiometricService.hasStoredCredential(), true);
      DeviceBiometricService.clearStoredCredential();
      assert.equal(DeviceBiometricService.hasStoredCredential(), false);
    });
  });

  describe('Native Android Bridge authentication', () => {
    it('detects native host app bridge availability', () => {
      assert.equal(DeviceBiometricService.isNativeApp(), false);

      (globalThis as any).window.HostNativeApp = {
        isBiometricAvailable: () => true,
        authenticateBiometrics: () => {}
      };

      assert.equal(DeviceBiometricService.isNativeApp(), true);
      assert.equal(DeviceBiometricService.isNativeBiometricAvailable(), true);
    });

    it('resolves successfully when native bridge succeeds', async () => {
      let authCalled = false;
      (globalThis as any).window.HostNativeApp = {
        isBiometricAvailable: () => true,
        authenticateBiometrics: () => {
          authCalled = true;
          // Simulate native callback
          setTimeout(() => {
            (globalThis as any).window.onHostNativeBiometricResult?.(true, null);
          }, 10);
        }
      };

      const result = await DeviceBiometricService.authenticate();
      assert.equal(authCalled, true);
      assert.equal(result.success, true);
    });

    it('returns Hebrew cancellation error when native bridge is cancelled', async () => {
      (globalThis as any).window.HostNativeApp = {
        isBiometricAvailable: () => true,
        authenticateBiometrics: () => {
          setTimeout(() => {
            (globalThis as any).window.onHostNativeBiometricResult?.(false, 'האימות בוטל');
          }, 10);
        }
      };

      const result = await DeviceBiometricService.authenticate();
      assert.equal(result.success, false);
      assert.equal(result.error, 'האימות בוטל');
    });
  });

  describe('WebAuthn authentication', () => {
    it('returns error when PublicKeyCredential is not supported', async () => {
      delete (globalThis as any).window.HostNativeApp;
      delete (globalThis as any).window.PublicKeyCredential;

      const result = await DeviceBiometricService.authenticate();
      assert.equal(result.success, false);
      assert.match(result.error || '', /אינו נתמך/);
    });

    it('handles NotAllowedError gracefully without deleting stored credential', async () => {
      delete (globalThis as any).window.HostNativeApp;
      mockStorage['cookoff_device_cred_id'] = 'dGVzdA=='; // 'test' in b64

      (globalThis as any).window.PublicKeyCredential = {
        isUserVerifyingPlatformAuthenticatorAvailable: async () => true
      };
      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          get: async () => {
            const err = new Error('User cancelled');
            err.name = 'NotAllowedError';
            throw err;
          }
        },
        configurable: true,
        writable: true
      });
      (globalThis as any).window.crypto = {
        getRandomValues: (buf: Uint8Array) => buf
      };

      const result = await DeviceBiometricService.authenticate();
      assert.equal(result.success, false);
      assert.equal(result.error, 'האימות בוטל');
      // Credential should NOT be removed if user simply cancelled
      assert.equal(DeviceBiometricService.hasStoredCredential(), true);
    });

    it('creates new passkey credential when none exists and saves to localStorage', async () => {
      delete (globalThis as any).window.HostNativeApp;

      (globalThis as any).window.PublicKeyCredential = {
        isUserVerifyingPlatformAuthenticatorAvailable: async () => true
      };
      const dummyRawId = new Uint8Array([10, 20, 30, 40]).buffer;
      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          create: async () => ({
            id: 'cred-1',
            rawId: dummyRawId,
            type: 'public-key'
          })
        },
        configurable: true,
        writable: true
      });
      (globalThis as any).window.crypto = {
        getRandomValues: (buf: Uint8Array) => buf
      };

      const result = await DeviceBiometricService.authenticate();
      assert.equal(result.success, true);
      assert.equal(DeviceBiometricService.hasStoredCredential(), true);
    });
  });
});
