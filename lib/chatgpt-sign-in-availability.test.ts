import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/navigation', () => ({ redirect: () => undefined }));

const { chatGPTSignInEnabled, chatGPTSignInPath } =
  await import('@/app/chatgpt-auth');

const original = process.env.CHATGPT_SIGN_IN_ENABLED;

afterEach(() => {
  if (original === undefined) delete process.env.CHATGPT_SIGN_IN_ENABLED;
  else process.env.CHATGPT_SIGN_IN_ENABLED = original;
});

describe('ChatGPT sign-in availability', () => {
  it('stays enabled by default so Sites-hosted deployments keep working', () => {
    delete process.env.CHATGPT_SIGN_IN_ENABLED;
    expect(chatGPTSignInEnabled()).toBe(true);
  });

  it('is disabled only by the explicit opt-out', () => {
    process.env.CHATGPT_SIGN_IN_ENABLED = 'false';
    expect(chatGPTSignInEnabled()).toBe(false);
  });

  it('treats any other value as enabled rather than silently hiding sign-in', () => {
    for (const value of ['true', 'TRUE', '1', 'yes', '']) {
      process.env.CHATGPT_SIGN_IN_ENABLED = value;
      expect(chatGPTSignInEnabled()).toBe(true);
    }
  });

  it('builds a sign-in path that returns to the requested page', () => {
    expect(chatGPTSignInPath('/')).toBe('/signin-with-chatgpt?return_to=%2F');
    expect(chatGPTSignInPath('/?view=contracts')).toBe(
      '/signin-with-chatgpt?return_to=%2F%3Fview%3Dcontracts',
    );
  });

  it('refuses to bounce back to an off-site or reserved return target', () => {
    for (const value of [
      'https://evil.test/',
      '//evil.test/',
      '/signin-with-chatgpt',
      '/signout-with-chatgpt',
      '/callback',
    ]) {
      expect(chatGPTSignInPath(value)).toBe(
        '/signin-with-chatgpt?return_to=%2F',
      );
    }
  });
});
