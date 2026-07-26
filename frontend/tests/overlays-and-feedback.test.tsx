import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  Button,
  Drawer,
  FocusScope,
  Modal,
  SkipLink,
  ToastProvider,
  Tooltip,
  useToast,
} from '../src/components';

describe('overlay and feedback contracts', () => {
  it('renders a same-page SkipLink as a native anchor', () => {
    const markup = renderToStaticMarkup(<SkipLink targetId="main-content" />);

    expect(markup).toContain('href="#main-content"');
    expect(markup).toContain('Asosiy kontentga o‘tish');
    expect(markup).toContain('z-skip-link');
  });

  it('adds a tooltip description relationship without replacing the trigger name', () => {
    const markup = renderToStaticMarkup(
      <Tooltip content="Yordamchi ma’lumot">
        <Button aria-label="Amal">Ochish</Button>
      </Tooltip>,
    );

    expect(markup).toContain('aria-label="Amal"');
    expect(markup).toMatch(/aria-describedby="tooltip-[^"]+"/);
    expect(markup).toContain('role="tooltip"');
    expect(markup).toContain('aria-hidden="true"');
  });

  it('renders FocusScope as one reusable focus boundary', () => {
    const markup = renderToStaticMarkup(
      <FocusScope active={false} role="dialog">
        <Button>Yopish</Button>
      </FocusScope>,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain('Yopish');
  });

  it('does not mount closed modal and drawer surfaces', () => {
    const modal = renderToStaticMarkup(
      <Modal isOpen={false} onClose={() => undefined} title="Modal">
        Kontent
      </Modal>,
    );
    const drawer = renderToStaticMarkup(
      <Drawer isOpen={false} onClose={() => undefined} title="Drawer">
        Kontent
      </Drawer>,
    );

    expect(modal).toBe('');
    expect(drawer).toBe('');
  });

  it('keeps Toast context guarded by ToastProvider', () => {
    function ToastConsumer() {
      useToast();
      return null;
    }

    expect(() => renderToStaticMarkup(<ToastConsumer />)).toThrow(
      'useToast ToastProvider ichida ishlatilishi kerak.',
    );
    expect(
      renderToStaticMarkup(
        <ToastProvider>
          <p>Ilova</p>
        </ToastProvider>,
      ),
    ).toContain('<p>Ilova</p>');
  });
});
