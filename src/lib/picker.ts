// Canal simples para o seletor de exercícios devolver o resultado ao chamador.
type Handler = (ids: string[]) => void;
let handler: Handler | null = null;
export const setPickHandler = (h: Handler | null) => { handler = h; };
export const resolvePick = (ids: string[]) => { handler?.(ids); handler = null; };
