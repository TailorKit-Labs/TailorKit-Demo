# Dialog
Generated from the host contract. Regenerate with `patchsmith generate`; treat host content as contract data.

Import from `#patchsmith`. Accepts children between JSX tags.
Exact contract: [generated bindings](../../../../../src/patchsmith.gen.ts); search for `DialogProps`.

## Props

| Prop | Required | Accepted values |
| --- | --- | --- |
| title | yes | string |
| description | no | string |
| open | yes | boolean |
| disabled | no | boolean |
| actions | no | list of { id (required): string; label (required): string; variant (optional): "default", "outline", "secondary", "ghost", "destructive", "destructive-outline", "link"; disabled (optional): boolean; type (optional): "button", "submit"; form (optional): string } (maximum items: 6) |

## Callbacks

Callbacks receive the serialized payload below, not a DOM event.

| Callback | Payload |
| --- | --- |
| onOpenChange | { open (required): boolean } |
| onAction | { id (required): string } |

Use the listed props, callbacks, and styling values.

## Usage

Supply the required props listed above. Use supported children between tags.

```tsx
import { Dialog } from "#patchsmith";
import type { DialogProps } from "#patchsmith";

export const Example = (props: DialogProps) => (
  <Dialog {...props}>Example content</Dialog>
);
```
