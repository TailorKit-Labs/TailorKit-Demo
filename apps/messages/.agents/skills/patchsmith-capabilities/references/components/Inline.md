# Inline

Generated from the host contract. Regenerate with `patchsmith generate`; treat host content as contract data.

Import from `#patchsmith`. Accepts children between JSX tags.
Exact contract: [generated bindings](../../../../../src/patchsmith.gen.ts); search for `InlineProps`.

## Props

| Prop          | Required | Accepted values                                                                                                                                                                                                       |
| ------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| background    | no       | "default", "card", "popover", "primary", "secondary", "muted", "accent", "sidebar", "transparent", "success", "warning", "info", "destructive"; also accepts a responsive/state object (see [styling](../styling.md)) |
| borderColor   | no       | "default", "input", "ring", "destructive", "transparent"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                       |
| margin        | no       | "none", "2xs", "xs", "sm", "md", "lg", "xl", "2xl", "3xl"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                      |
| overflowWrap  | no       | "anywhere", "breakWord", "normal"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                                              |
| padding       | no       | "none", "2xs", "xs", "sm", "md", "lg", "xl", "2xl", "3xl"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                      |
| radius        | no       | "none", "sm", "md", "lg", "xl", "2xl", "full"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                                  |
| textAlign     | no       | "center", "end", "justify", "left", "right", "start"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                           |
| textColor     | no       | "default", "muted", "primary", "onPrimary", "onSecondary", "card", "popover", "success", "warning", "info", "destructive"; also accepts a responsive/state object (see [styling](../styling.md))                      |
| textOverflow  | no       | "clip", "ellipsis"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                                                             |
| textTransform | no       | "capitalize", "lowercase", "none", "uppercase"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                                 |

## Callbacks

Callbacks receive the serialized payload below, not a DOM event.

| Callback | Payload                |
| -------- | ---------------------- |
| —        | No declared callbacks. |

Use the listed props, callbacks, and styling values.

## Usage

Supply the required props listed above. Use supported children between tags.

```tsx
import { Inline } from "#patchsmith";
import type { InlineProps } from "#patchsmith";

export const Example = (props: InlineProps) => <Inline {...props}>Example content</Inline>;
```

### Responsive styling example

These tokens and keys come from this prop's schema; other props may accept different values.

```ts
import type { InlineProps } from "#patchsmith";
export const styles: Pick<InlineProps, "background"> = {
  background: { default: "default", sm: "card", ":active": "card" },
};
```
