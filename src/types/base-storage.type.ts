/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


export type BaseStorageType = {
    getItem:    (key: string) => Promise<any>,
    setItem:    (key: string, state: any, version?: number) => Promise<void>,
    removeItem: (key: string) => Promise<void>
};
