/** The character that matches any run of characters (including none) in a watched entity id (#95). */
const WILDCARD = '*';

const patterns = new Map<string, RegExp>();
const warned = new Set<string>();

const toRegExp = (pattern: string): RegExp => {
  let regExp = patterns.get(pattern);
  if (!regExp) {
    const source = pattern
      .split(WILDCARD)
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*');
    regExp = new RegExp(`^${source}$`);
    patterns.set(pattern, regExp);
  }
  return regExp;
};

/**
 * Replaces each id containing `*` with the ids in `available` that match it, in `available` order.
 * Every other character is matched literally, so `light.*` does not match `lightXhall`.
 */
export const expandWildcards = (ids: string[], available: string[]): string[] =>
  ids.flatMap((id) => {
    if (!id.includes(WILDCARD)) {
      return [id];
    }

    if (id.split(WILDCARD).every((part) => part === '') && !warned.has(id)) {
      warned.add(id);
      console.warn(
        `config-template-card: \`${id}\` in \`entities\` watches every entity, so the card re-renders on every state change`,
      );
    }

    const regExp = toRegExp(id);
    return available.filter((candidate) => regExp.test(candidate));
  });
