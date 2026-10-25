import { mount } from 'svelte';
import './app.css';
import Smoke from '../../Smoke.svelte';

mount(Smoke, { target: document.getElementById('app') as HTMLElement });
