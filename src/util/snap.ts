
export function snap(value: number, step: number): number {
    if(step===0) return value;
    return Math.round(value / step) * step;
}
