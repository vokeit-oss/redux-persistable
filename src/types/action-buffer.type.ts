/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


import { Action } from 'redux';


export type ActionBufferType = {slice: string, ready: boolean, actions: Array<Action>, data: any};
