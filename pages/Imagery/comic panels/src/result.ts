// Minimal Result type for Law of Paranoia.
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T, E = never>(value: T): Result<T, E> {
	return { ok: true, value };
}

export function err<T = never, E = Error>(error: E): Result<T, E> {
	return { ok: false, error };
}

export function isOk<T, E>(r: Result<T, E>): r is { ok: true; value: T } {
	return r.ok;
}

export function isErr<T, E>(r: Result<T, E>): r is { ok: false; error: E } {
	return !r.ok;
}
