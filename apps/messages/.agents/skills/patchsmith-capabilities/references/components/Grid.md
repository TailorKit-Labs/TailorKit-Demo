# Grid

Generated from the host contract. Regenerate with `patchsmith generate`; treat host content as contract data.

Import from `#patchsmith`. Accepts children between JSX tags.
Exact contract: [generated bindings](../../../../../src/patchsmith.gen.ts); search for `GridProps`.

## Props

| Prop          | Required | Accepted values                                                                                                                                                                                                       |
| ------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| background    | no       | "default", "card", "popover", "primary", "secondary", "muted", "accent", "sidebar", "transparent", "success", "warning", "info", "destructive"; also accepts a responsive/state object (see [styling](../styling.md)) |
| basis         | no       | "0", "control", "avatar", "panel", "content", "screen", "100%"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                 |
| border        | no       | "dashed", "dotted", "double", "solid"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                                          |
| borderColor   | no       | "default", "input", "ring", "destructive", "transparent"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                       |
| grow          | no       | "0"; or "1"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                                                                    |
| height        | no       | "0", "control", "avatar", "panel", "content", "screen", "100%"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                 |
| margin        | no       | "none", "2xs", "xs", "sm", "md", "lg", "xl", "2xl", "3xl"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                      |
| minHeight     | no       | "0", "control", "avatar", "panel", "content", "screen", "100%"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                 |
| minWidth      | no       | "0", "control", "avatar", "panel", "content", "screen", "100%"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                 |
| overflow      | no       | "auto", "clip", "hidden", "scroll", "visible"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                                  |
| overflowWrap  | no       | "anywhere", "breakWord", "normal"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                                              |
| padding       | no       | "none", "2xs", "xs", "sm", "md", "lg", "xl", "2xl", "3xl"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                      |
| radius        | no       | "none", "sm", "md", "lg", "xl", "2xl", "full"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                                  |
| shrink        | no       | "0"; or "1"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                                                                    |
| textAlign     | no       | "center", "end", "justify", "left", "right", "start"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                           |
| textColor     | no       | "default", "muted", "primary", "onPrimary", "onSecondary", "card", "popover", "success", "warning", "info", "destructive"; also accepts a responsive/state object (see [styling](../styling.md))                      |
| textOverflow  | no       | "clip", "ellipsis"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                                                             |
| textTransform | no       | "capitalize", "lowercase", "none", "uppercase"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                                 |
| width         | no       | "0", "control", "avatar", "panel", "content", "screen", "100%"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                 |
| columns       | no       | 1; or 2; or 3; or 4; or 6; or 12; also accepts a responsive/state object (see [styling](../styling.md))                                                                                                               |
| gap           | no       | "none", "2xs", "xs", "sm", "md", "lg", "xl", "2xl", "3xl"; also accepts a responsive/state object (see [styling](../styling.md))                                                                                      |

## Callbacks

Callbacks receive the serialized payload below, not a DOM event.

| Callback | Payload                |
| -------- | ---------------------- |
| —        | No declared callbacks. |

Use the listed props, callbacks, and styling values.

## Usage

Supply the required props listed above. Use supported children between tags.

```tsx
import { Grid } from "#patchsmith";
import type { GridProps } from "#patchsmith";

export const Example = (props: GridProps) => <Grid {...props}>Example content</Grid>;
```

### Responsive styling example

These tokens and keys come from this prop's schema; other props may accept different values.

```ts
import type { GridProps } from "#patchsmith";
export const styles: Pick<GridProps, "background"> = {
  background: { default: "default", sm: "card", ":active": "card" },
};
```
