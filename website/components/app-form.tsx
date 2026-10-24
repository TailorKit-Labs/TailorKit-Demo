"use client";

import type { ReactNode } from "react";
import type { z } from "zod";
import type { contract } from "@/lib/patchsmith";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from "@/components/ui/dialog";

type AppFormProps = z.infer<typeof contract.components.Form.fields> & {
  children?: ReactNode;
  onSubmit?: () => unknown;
};

export function AppForm({
  id,
  plain = false,
  submitLabel,
  disabled,
  onSubmit,
  children,
}: AppFormProps) {
  return (
    <form
      id={id}
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled) onSubmit?.();
      }}
    >
      {plain ? (
        children
      ) : (
        <div className="flex flex-col gap-4">
          {children}
          <Button type="submit" disabled={disabled}>
            {submitLabel ?? "Save"}
          </Button>
        </div>
      )}
    </form>
  );
}

type AppDialogProps = z.infer<typeof contract.components.Dialog.fields> & {
  children?: ReactNode;
  onOpenChange?: (event: { open: boolean }) => unknown;
  onAction?: (event: { id: string }) => unknown;
  onSubmit?: () => unknown;
};

export function AppDialog({
  open,
  title,
  description,
  disabled,
  actions,
  onOpenChange,
  onAction,
  onSubmit,
  children,
}: AppDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(open) => onOpenChange?.({ open })}>
      <DialogPopup
        render={
          onSubmit ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!disabled) onSubmit();
              }}
            />
          ) : undefined
        }
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogPanel>{children}</DialogPanel>
        {actions?.length ? (
          <DialogFooter className="flex-row justify-end">
            {actions.map((action) => (
              <Button
                key={action.id}
                type={action.type ?? "button"}
                form={action.form}
                variant={action.variant}
                disabled={disabled || action.disabled}
                onClick={action.type === "submit" ? undefined : () => onAction?.({ id: action.id })}
              >
                {action.label}
              </Button>
            ))}
          </DialogFooter>
        ) : null}
      </DialogPopup>
    </Dialog>
  );
}
