<script lang="ts">
import { Button } from 'texuli/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'texuli/card';
import { Switch } from 'texuli/choice';
import { Input } from 'texuli/input';
</script>

<section class="screen" aria-label="Settings">
  <Card variant="elevated">
    <CardHeader>
      <CardTitle level={2}>Profile</CardTitle>
      <CardDescription>Harbor Notes account (fictional)</CardDescription>
    </CardHeader>
    <CardContent>
      <form class="form" onsubmit={(e) => e.preventDefault()}>
        <label class="field">
          <span>Display name</span>
          <Input value="Ada Example" name="name" autocomplete="name" />
        </label>
        <label class="field">
          <span>Email</span>
          <Input type="email" value="ada@example.com" name="email" autocomplete="email" />
        </label>
        <Button type="submit">Save profile</Button>
      </form>
    </CardContent>
  </Card>

  <Card variant="flat">
    <CardHeader>
      <CardTitle level={2}>Notifications</CardTitle>
      <CardDescription>Email and product alerts</CardDescription>
    </CardHeader>
    <CardContent>
      <ul class="toggles">
        <li>
          <Switch checked label="Weekly digest" />
        </li>
        <li>
          <Switch checked label="@mentions" />
        </li>
        <li>
          <Switch label="Product tips" />
        </li>
      </ul>
    </CardContent>
  </Card>

  <Card variant="flat">
    <CardHeader>
      <CardTitle level={2}>Workspace</CardTitle>
    </CardHeader>
    <CardContent>
      <p class="muted">Workspace “Harbor Notes” · Plan: Demo · Region: fictional</p>
      <Button type="button" variant="destructive" size="sm">Leave workspace</Button>
    </CardContent>
  </Card>
</section>

<style>
  .screen {
    display: grid;
    gap: 1rem;
    max-inline-size: 36rem;
  }
  .form {
    display: grid;
    gap: 1rem;
  }
  .field {
    display: grid;
    gap: 0.35rem;
    font-size: 0.875rem;
    font-weight: 500;
  }
  .toggles {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.85rem;
  }
  .toggles li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .muted {
    margin: 0 0 0.75rem;
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.875rem;
  }
</style>
