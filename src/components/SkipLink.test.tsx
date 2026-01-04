import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { SkipLink } from '@/components/SkipLink';

describe('SkipLink', () => {
  it('should render with correct text', () => {
    render(
      <>
        <SkipLink />
        <main id="main-content">Main Content</main>
      </>
    );

    const skipLink = screen.getByText('Skip to main content');
    expect(skipLink).toBeInTheDocument();
  });

  it('should have correct href attribute', () => {
    render(
      <>
        <SkipLink />
        <main id="main-content">Main Content</main>
      </>
    );

    const skipLink = screen.getByText('Skip to main content');
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  it('should be focusable with keyboard', async () => {
    const user = userEvent.setup();
    render(
      <>
        <SkipLink />
        <main id="main-content">Main Content</main>
      </>
    );

    const skipLink = screen.getByText('Skip to main content');
    
    // Tab to focus the skip link
    await user.tab();
    
    expect(skipLink).toHaveFocus();
  });

  it('should focus main content when clicked', async () => {
    const user = userEvent.setup();
    render(
      <>
        <SkipLink />
        <main id="main-content" tabIndex={-1}>
          Main Content
        </main>
      </>
    );

    const skipLink = screen.getByText('Skip to main content');
    const mainContent = screen.getByText('Main Content');
    
    await user.click(skipLink);
    
    // The click should trigger focus on main content
    expect(mainContent).toHaveFocus();
  });

  it('should have proper accessibility attributes', () => {
    render(
      <>
        <SkipLink />
        <main id="main-content">Main Content</main>
      </>
    );

    const skipLink = screen.getByText('Skip to main content');
    
    // Skip link should be a link element
    expect(skipLink.tagName).toBe('A');
    
    // Should have href for navigation
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });
});
