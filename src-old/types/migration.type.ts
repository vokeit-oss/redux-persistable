/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


export type MigrationType = {
    version:   number,
    migration: (state: any, version?: number) => {state: any, version: number}
};