/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


export type TransformType = {
    transformDataToStorage:   (state: any, key: string) => any,
    transformDataFromStorage: (state: any, key: string) => any
};