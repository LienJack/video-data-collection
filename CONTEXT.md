# EgoCapture

EgoCapture manages first-person video collection from authored instructions through a traceable recording and upload chain.

## Language

**Task**:
A mutable authoring workspace for one reusable set of recording and upload instructions.
_Avoid_: Task Draft, job

**TaskVersion**:
An immutable published snapshot of a Task that can be assigned and acknowledged.
_Avoid_: revision, live task

**Assignment**:
A participant-specific binding to one TaskVersion, with its own due date, locale, and lifecycle.
_Avoid_: allocation, participant task

**Recording Session**:
One declared execution of an Assignment by a Participant with a Device.
_Avoid_: recording, upload session

**Session Marker**:
A signed visual token for a Recording Session that can be shown at capture time without making automated recognition part of the MVP.
_Avoid_: QR classifier, file label

**Upload Intent**:
The participant's declaration of one source file and its claimed Recording Session before bytes are transferred.
_Avoid_: video, upload

**Video Asset**:
A verified stored source file together with its metadata, matching decisions, and review history.
_Avoid_: upload, recording session
