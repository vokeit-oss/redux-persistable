/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


export type TransformType = {
    out: (state: any, key: string) => any,
    in:  (state: any, key: string) => any
};