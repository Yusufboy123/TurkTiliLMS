import { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  Badge,
  Button,
  Card,
  FormField,
  IconButton,
  Input,
  Select,
  Skeleton,
  Spinner,
  Textarea,
} from '../src/components';

describe('foundation primitive semantics', () => {
  it('renders the button as a native button with its visible label', () => {
    const markup = renderToStaticMarkup(
      <Button intent="primary" type="submit">
        Saqlash
      </Button>,
    );

    expect(markup).toContain('<button');
    expect(markup).toContain('type="submit"');
    expect(markup).toContain('<span>Saqlash</span>');
    expect(markup).toContain('bg-action-primary-bg');
  });

  it('retains its label and exposes progress semantics while loading', () => {
    const markup = renderToStaticMarkup(<Button loading>Saqlash</Button>);

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('data-loading="true"');
    expect(markup).toContain('<span>Saqlash</span>');
    expect(markup).not.toContain('disabled=""');
  });

  it('uses native disabled semantics and shared disabled tokens', () => {
    const markup = renderToStaticMarkup(<Button disabled>O‘chirish</Button>);

    expect(markup).toContain('disabled=""');
    expect(markup).toContain('disabled:bg-action-disabled-bg');
  });

  it('requires and renders an accessible IconButton name', () => {
    const markup = renderToStaticMarkup(
      <IconButton aria-label="Yopish" icon={<span aria-hidden="true">×</span>} />,
    );

    expect(markup).toContain('aria-label="Yopish"');
    expect(markup).toContain('<button');
    expect(markup).toContain('h-11 w-11');
  });

  it('applies the same interaction contract to Button and IconButton', () => {
    const buttonMarkup = renderToStaticMarkup(
      <Button intent="danger" loading>
        O‘chirish
      </Button>,
    );
    const iconButtonMarkup = renderToStaticMarkup(
      <IconButton
        aria-label="O‘chirish"
        icon={<span aria-hidden="true">×</span>}
        intent="danger"
        loading
      />,
    );

    for (const markup of [buttonMarkup, iconButtonMarkup]) {
      expect(markup).toContain('bg-action-danger-bg');
      expect(markup).toContain('focus-visible:outline-focus');
      expect(markup).toContain('disabled:bg-action-disabled-bg');
      expect(markup).toContain('aria-busy="true"');
      expect(markup).toContain('aria-disabled="true"');
      expect(markup).toContain('data-loading="true"');
    }
  });

  it('associates Input with FormField label, description, error, and required state', () => {
    const markup = renderToStaticMarkup(
      <FormField
        controlId="email"
        description="Ishchi elektron pochta manzilini kiriting."
        error="Elektron pochta noto‘g‘ri."
        label="Elektron pochta"
        required
      >
        <Input name="email" type="email" />
      </FormField>,
    );

    expect(markup).toContain('for="email"');
    expect(markup).toContain('id="email"');
    expect(markup).toContain('aria-describedby="email-description email-error"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('required=""');
    expect(markup).toContain('role="alert"');
  });

  it('shares FormField associations with Textarea and Select', () => {
    const textareaMarkup = renderToStaticMarkup(
      <FormField controlId="bio" label="Izoh">
        <Textarea />
      </FormField>,
    );
    const selectMarkup = renderToStaticMarkup(
      <FormField controlId="role" label="Rol" required>
        <Select>
          <option value="student">Talaba</option>
        </Select>
      </FormField>,
    );

    expect(textareaMarkup).toContain('id="bio"');
    expect(textareaMarkup).toContain('(Ixtiyoriy)');
    expect(selectMarkup).toContain('id="role"');
    expect(selectMarkup).toContain('required=""');
  });

  it('preserves explicit accessibility overrides consistently across form controls', () => {
    const renderControl = (control: ReactNode) =>
      renderToStaticMarkup(
        <FormField controlId="shared-field" error="Xatolik" label="Maydon" required>
          {control}
        </FormField>,
      );

    for (const markup of [
      renderControl(
        <Input aria-describedby="custom-description" aria-invalid={false} required={false} />,
      ),
      renderControl(
        <Textarea aria-describedby="custom-description" aria-invalid={false} required={false} />,
      ),
      renderControl(
        <Select aria-describedby="custom-description" aria-invalid={false} required={false}>
          <option value="value">Qiymat</option>
        </Select>,
      ),
    ]) {
      expect(markup).toContain('id="shared-field"');
      expect(markup).toContain('aria-describedby="custom-description"');
      expect(markup).toContain('aria-invalid="false"');
      expect(markup).not.toContain('required=""');
    }
  });

  it('renders display and feedback primitives with semantic token classes', () => {
    const markup = renderToStaticMarkup(
      <Card>
        <Badge intent="success">Faol</Badge>
        <Skeleton aria-label="Karta yuklanmoqda" />
        <Spinner delayMs={0} label="Yuklanmoqda" />
      </Card>,
    );

    expect(markup).toContain('bg-surface');
    expect(markup).toContain('bg-success-bg');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-label="Yuklanmoqda"');
  });
});
