
// A finite number > 0, else the fallback.
export function positiveNum(value: string | undefined, fallback: number): number {
	const n = Number(value);
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

// A finite integer >= 0, else the fallback.
export function nonNegativeInt(
	value: string | undefined,
	fallback: number,
): number {
	const n = Number(value);
	return Number.isInteger(n) && n >= 0 ? n : fallback;
}

// Strict "true"/"false"; anything else falls back.
export function bool(value: string | undefined, fallback: boolean): boolean {
	if (value === "true") return true;
	if (value === "false") return false;
	return fallback;
}

// A non-empty trimmed string, else the fallback.
export function str(value: string | undefined, fallback: string): string {
	const s = value?.trim();
	return s ? s : fallback;
}
