<script lang="ts">
import { Code, type CodeVariant } from '../../src/components/kbd-code/index.ts';

let {
  value = '',
  variant = 'inline' as CodeVariant,
  language = undefined as string | undefined,
}: {
  value?: string;
  variant?: CodeVariant;
  language?: string;
} = $props();
</script>

<Code {value} {variant} {language} />
