## Schemas, conditions and steps

Schemas use closed field types, named formats, validation rules and expression data. Conditions use `when.show`, `when.require` and `when.enable`; expressions are evaluated by the bounded language from `@texuli/core/expression`. Multi-step schemas group fields into steps, and hidden or disabled fields are excluded from validation and submission.

Validate the schema before rendering. The validator returns either a compiled form or issues that identify invalid members and relationships.
