### v1.0.2

- Fixed race condition leading to outdated state passed to reducers

### v0.1.0-beta.5

- Fixed flushing ActionBuffer

### v0.1.0-beta.4

- Actions with a "slice" property now always get buffered until their slice has been rehydrated, this should solve usual timing isues


### v0.1.0-beta.1

- Added versioned states with migrations applied directly after de-serialization from storage
- Changed TransformType to use better recognizable names transformDataToStorage and transformDataFromStorage
- Added documentation