<script lang="ts">
import { Badge } from 'texuli/badge';
import { Button } from 'texuli/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'texuli/card';
import { Input } from 'texuli/input';
</script>

<section class="checkout" aria-label="Checkout">
  <Card variant="elevated">
    <CardHeader>
      <CardTitle level={2}>Order summary</CardTitle>
      <CardDescription>Harbor Notes Pro · annual (fictional)</CardDescription>
    </CardHeader>
    <CardContent>
      <ul class="lines">
        <li>
          <span>Pro seats × 5</span>
          <span>$1,200</span>
        </li>
        <li>
          <span>Media studio add-on</span>
          <span>$180</span>
        </li>
        <li class="total">
          <span>Total due today</span>
          <span>$1,380</span>
        </li>
      </ul>
      <Badge variant="secondary">Taxes calculated at demo rates</Badge>
    </CardContent>
  </Card>

  <Card variant="flat">
    <CardHeader>
      <CardTitle level={2}>Payment</CardTitle>
      <CardDescription>Demo fields only — nothing is charged</CardDescription>
    </CardHeader>
    <CardContent>
      <form class="form" onsubmit={(e) => e.preventDefault()}>
        <label class="field">
          <span>Name on card</span>
          <Input name="cc-name" autocomplete="cc-name" value="Ada Example" />
        </label>
        <label class="field">
          <span>Card number</span>
          <Input name="cc-number" autocomplete="cc-number" inputmode="numeric" value="4242 4242 4242 4242" />
        </label>
        <div class="row">
          <label class="field">
            <span>Expiry</span>
            <Input name="cc-exp" autocomplete="cc-exp" value="12/28" />
          </label>
          <label class="field">
            <span>CVC</span>
            <Input name="cc-csc" autocomplete="cc-csc" value="123" />
          </label>
        </div>
        <Button type="submit">Pay $1,380</Button>
      </form>
    </CardContent>
  </Card>
</section>

<style>
  .checkout {
    display: grid;
    gap: 1rem;
    max-inline-size: 28rem;
  }
  .lines {
    list-style: none;
    margin: 0 0 0.75rem;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }
  .lines li {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.95rem;
  }
  .total {
    font-weight: 600;
    padding-block-start: 0.5rem;
    border-block-start: 1px solid var(--tx-border, ButtonBorder);
  }
  .form {
    display: grid;
    gap: 0.85rem;
  }
  .field {
    display: grid;
    gap: 0.35rem;
    font-size: 0.875rem;
    font-weight: 500;
  }
  .row {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: 1fr 1fr;
  }
</style>
