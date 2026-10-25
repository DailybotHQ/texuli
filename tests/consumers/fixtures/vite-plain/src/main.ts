import { mount } from 'svelte';
import '@texuli/tokens/base.css';
import Smoke from '../../Smoke.svelte';

mount(Smoke, { target: document.getElementById('app') as HTMLElement });
