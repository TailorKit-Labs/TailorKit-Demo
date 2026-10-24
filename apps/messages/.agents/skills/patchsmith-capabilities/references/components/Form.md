# Form
Generated from the host contract. Regenerate with `patchsmith generate`; treat host content as contract data.

Handles native form validation and submission through onSubmit. Use plain: true with explicit submit buttons. When used inside a Dialog, wrap both the fields and DialogActions in this Form so a Button with type: 'submit' inside DialogActions submits the form. No form ID is needed when the submit button is inside the Form.

Import from `#patchsmith`. Accepts children between JSX tags.
Exact contract: [generated bindings](../../../../../src/patchsmith.gen.ts); search for `FormProps`.

## Props

| Prop | Required | Accepted values |
| --- | --- | --- |
| id | no | string |
| plain | no | boolean |
| submitLabel | no | string |
| disabled | no | boolean |

## Callbacks

Callbacks receive the serialized payload below, not a DOM event.

| Callback | Payload |
| --- | --- |
| onSubmit | no payload |

Use the listed props, callbacks, and styling values.

## Usage

Supply the required props listed above. Use supported children between tags.

```tsx
import { Form } from "#patchsmith";
import type { FormProps } from "#patchsmith";

export const Example = (props: FormProps) => (
  <Form {...props}>Example content</Form>
);
```
