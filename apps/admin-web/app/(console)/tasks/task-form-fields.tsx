"use client";

import { Badge } from "@egocapture/ui/components/badge";
import { Button } from "@egocapture/ui/components/button";
import { Input } from "@egocapture/ui/components/input";
import { Label } from "@egocapture/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { PlusIcon, XIcon } from "@phosphor-icons/react";
import { useState } from "react";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="mt-2 text-sm font-medium text-destructive">{message}</p>;
}

export function TextListField({
  id,
  label,
  items,
  onChange,
  placeholder,
  addLabel,
  error,
  maxItems = 30,
}: {
  id: string;
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  addLabel: string;
  error?: string;
  maxItems?: number;
}) {
  const errorId = `${id}-error`;
  return (
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <div className="mt-3 space-y-3">
        {items.map((item, index) => {
          const inputId = `${id}-${index}`;
          return (
            <div key={inputId} className="flex items-start gap-2">
              <Label htmlFor={inputId} className="sr-only">{label} {index + 1}</Label>
              <Input
                id={inputId}
                value={item}
                onChange={(event) => onChange(items.map((value, itemIndex) => itemIndex === index ? event.target.value : value))}
                placeholder={placeholder}
                maxLength={500}
                required
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                aria-label={`移除${label} ${index + 1}`}
              >
                <XIcon aria-hidden="true" />
              </Button>
            </div>
          );
        })}
      </div>
      <Button
        type="button"
        variant="outline"
        className="mt-3"
        onClick={() => onChange([...items, ""])}
        disabled={items.length >= maxItems}
      >
        <PlusIcon aria-hidden="true" />
        {addLabel}
      </Button>
      <FieldError id={errorId} message={error} />
    </div>
  );
}

export function TagSelectField({
  id,
  label,
  values,
  presets,
  onChange,
  customPlaceholder,
  error,
  maxItems = 30,
}: {
  id: string;
  label: string;
  values: string[];
  presets: string[];
  onChange: (values: string[]) => void;
  customPlaceholder: string;
  error?: string;
  maxItems?: number;
}) {
  const [customValue, setCustomValue] = useState("");
  const [localError, setLocalError] = useState("");
  const errorId = `${id}-error`;

  function add(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      setLocalError("请输入自定义选项");
      return;
    }
    if (values.some((item) => item.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
      setLocalError(`“${trimmed}”已经添加`);
      return;
    }
    if (values.length >= maxItems) {
      setLocalError(`最多添加 ${maxItems} 项`);
      return;
    }
    onChange([...values, trimmed]);
    setCustomValue("");
    setLocalError("");
  }

  const availablePresets = presets.filter((preset) => !values.some((item) => item.toLocaleLowerCase() === preset.toLocaleLowerCase()));
  const message = error || localError;
  return (
    <div>
      <p className="text-sm font-semibold">{label}</p>
      {values.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label={`已选${label}`}>
          {values.map((value, index) => (
            <li key={`${value}-${index}`}>
              <Badge variant="secondary" className="gap-2 py-1 ps-3 pe-1 text-sm">
                {value}
                <button
                  type="button"
                  className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
                  aria-label={`从${label}中移除“${value}”`}
                >
                  <XIcon aria-hidden="true" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sm text-muted-foreground">尚未添加。</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${id}-preset`}>从预设中添加</Label>
          <NativeSelect
            id={`${id}-preset`}
            value=""
            onChange={(event) => {
              if (event.target.value) add(event.target.value);
            }}
            className="mt-2 w-full"
            aria-describedby={message ? errorId : undefined}
          >
            <NativeSelectOption value="">选择一个预设选项</NativeSelectOption>
            {availablePresets.map((preset) => <NativeSelectOption key={preset} value={preset}>{preset}</NativeSelectOption>)}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor={`${id}-custom`}>添加自定义选项</Label>
          <div className="mt-2 flex gap-2">
            <Input
              id={`${id}-custom`}
              value={customValue}
              onChange={(event) => setCustomValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  add(customValue);
                }
              }}
              placeholder={customPlaceholder}
              maxLength={300}
              aria-invalid={Boolean(message)}
              aria-describedby={message ? errorId : undefined}
            />
            <Button type="button" variant="outline" onClick={() => add(customValue)} aria-label={`添加自定义${label}`}>
              <PlusIcon aria-hidden="true" />
              添加
            </Button>
          </div>
        </div>
      </div>
      <FieldError id={errorId} message={message} />
    </div>
  );
}
