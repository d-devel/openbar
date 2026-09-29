// Permissive stub for library calls whose results do not matter (file I/O, pixbufs, theme context...)
const handler = {
    get(t, p) {
        if (p === 'then') return undefined;                     // not a thenable: 'await stub' resolves
        if (p === Symbol.iterator) return function* () {};      // iterable and destructurable (empty)
        if (p === Symbol.hasInstance) return () => false;
        if (p === Symbol.toPrimitive) return hint => (hint === 'string' ? '[stub]' : 0);
        if (p === 'connect') return () => { throw new Error('connect() on an untracked stub object'); };
        return stub();
    },
    apply: () => stub(),
    construct: () => stub(),
};
export function stub() { return new Proxy(function () {}, handler); }
export default stub();
