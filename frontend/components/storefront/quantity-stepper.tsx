"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function QuantityStepper({ value, onChange, min = 1, max = 999 }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="icon" onClick={() => onChange(clamp(value - 1))} disabled={value <= min}>−</Button>
      <Input className="w-20 text-center" value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value) || min))} inputMode="numeric" />
      <Button type="button" variant="outline" size="icon" onClick={() => onChange(clamp(value + 1))} disabled={value >= max}>+</Button>
    </div>
  );
}
