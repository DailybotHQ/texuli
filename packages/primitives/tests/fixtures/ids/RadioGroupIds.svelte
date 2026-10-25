<script lang="ts">
import { RadioGroup } from '../../../src/radio-group/index.ts';
</script>

<span id="plan-heading">Plan</span>
<RadioGroup.Root id="plan-group" aria-labelledby="plan-heading" value="team">
  <RadioGroup.Item id="plan-free" value="free" />
  <label for="plan-free">Free</label>
  <RadioGroup.Item id="plan-team" value="team" />
  <label for="plan-team">Team</label>
</RadioGroup.Root>
