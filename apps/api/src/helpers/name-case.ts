/**
 * Converts a user-supplied name into a capitalized (title) form.
 *
 * Capitalizes the first letter of every whitespace-separated token and
 * lowercases the rest, so "john DOE" -> "John Doe". Leading/trailing
 * whitespace is trimmed. Returns null for empty/whitespace-only input.
 */
export function titleCaseName(value: string | null | undefined): string | null {
	if (value == null) return null;
	const trimmed = value.trim();
	if (!trimmed) return null;

	return trimmed
		.split(/\s+/)
		.map((token) => {
			if (!token) return token;
			return (
				token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()
			);
		})
		.join(" ");
}
