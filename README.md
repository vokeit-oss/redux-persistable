# redux-persistable
State persistance for redux stores supporting immutablejs for the whole state.

## Documentation
TBD.

## Quick instructions
```
import {
    combineReducers,
    immutableMerger,
    persistableEnhancer
} from '@actra-development-oss/redux-persistable/lib';
import { Map } from 'immutable';
import {
    Action,
    createStore
} from 'redux';

const reducers         = {};
const initialState     = Map();
const immutableRecords = [];
const transforms       = [];
const serializer       = new ImmutableSerializer(immutableRecords);
const storage          = new LocalstorageStorage(serializer, transforms);

const store = createStore(
    Object.keys(reducers).length ? combineReducers(reducers, Map()) : (state: any, action: Action) => state,
    initialState,
    composer(
        /* applyMiddleware(...middlewares), */
        persistableEnhancer({
            merger:     immutableMerger,
            storage:    storage,
            storageKey: 'my-store'
        })
    )
);
```