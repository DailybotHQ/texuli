<script lang="ts">
import {
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
} from '../../../src/label/index.ts';
</script>

<FieldRoot invalid>
  <FieldLabel id="email-label">Work email</FieldLabel>
  <FieldControl id="email" type="email" />
  <FieldDescription id="email-help">We never share it.</FieldDescription>
  <FieldError id="email-error">Enter an address at example.com.</FieldError>
</FieldRoot>
