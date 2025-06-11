/* eslint-disable @typescript-eslint/no-explicit-any */

export type StartsWith<T extends string, U extends string> = T extends `${U}${string}`? T : never;

export type Filter<T extends any[],U> = T extends [infer F,...infer R] ? 
F extends U ?
    [F,...Filter<R,U>]
    :Filter<R,U>
:[]

export type Flatten<T extends any[]> = T extends []
  ? []
  : T extends [infer F, ...infer R]
  ? F extends any[]
    ? [...Flatten<F>, ...Flatten<R>]
    : [F, ...Flatten<R>]
  : [T];
