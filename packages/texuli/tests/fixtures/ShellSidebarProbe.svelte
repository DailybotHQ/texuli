<script lang="ts">
import { isInDrawer } from '../../src/layouts/shells/index.ts';

const where = isInDrawer() ? 'drawer' : 'column';
</script>

<nav aria-label={`Sections (${where})`}>
  <a href="#/inbox">Inbox</a>
  <span data-testid={`sidebar-${where}`}>{where}</span>
</nav>
