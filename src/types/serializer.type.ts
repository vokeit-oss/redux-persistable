/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


export type SerializerType = {
    setRecords: (records: any[]) => void,
    serialize:  (state: any) => string,
    parse:      (data: string) => any
};