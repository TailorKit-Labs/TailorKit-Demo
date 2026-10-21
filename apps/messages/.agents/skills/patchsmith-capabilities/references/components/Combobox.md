# Combobox

Generated from the host contract. Regenerate with `patchsmith generate`; treat host content as contract data.

Import from `#patchsmith`. Does not accept children.
Exact contract: [generated bindings](../../../../../src/patchsmith.gen.ts); search for `ComboboxProps`.

## Props

| Prop         | Required | Accepted values                                                                                                     |
| ------------ | -------- | ------------------------------------------------------------------------------------------------------------------- |
| label        | yes      | string                                                                                                              |
| value        | yes      | string or null                                                                                                      |
| options      | yes      | list of { label (required): string; value (required): string; description (optional): string } (maximum items: 100) |
| placeholder  | no       | string                                                                                                              |
| emptyMessage | no       | string                                                                                                              |
| disabled     | no       | boolean                                                                                                             |

## Callbacks

Callbacks receive the serialized payload below, not a DOM event.

| Callback | Payload                      |
| -------- | ---------------------------- |
| onChange | { value (required): string } |

Use the listed props, callbacks, and styling values.

## Usage

Supply the required props listed above. This component does not accept children.

```tsx
import { Combobox } from "#patchsmith";
import type { ComboboxProps } from "#patchsmith";

export const Example = (props: ComboboxProps) => <Combobox {...props} />;
```
