## Decisions
- Modified `getUnprocessedDocuments` to support both inclusion of a 'receipt' tag and exclusion of a 'processed' tag.
- Used `undefined` as the first argument in `runAutomation` to allow the default `processedTagName` from config to be used while specifying a custom `receiptTag`.
