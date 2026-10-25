<script lang="ts">
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardGrid,
  CardHeader,
  CardMedia,
  CardTitle,
} from 'texuli/card';
</script>

<section data-example="texuli-card" aria-labelledby="card-demo-title">
  <h2 id="card-demo-title">Card</h2>

  <h3>Elevated and flat</h3>
  <CardGrid minItemWidth="14rem" gap="md">
    <Card variant="elevated">
      <CardHeader>
        <CardTitle level={3}>Elevated card</CardTitle>
        <CardDescription>Default surface with soft elevation.</CardDescription>
      </CardHeader>
      <CardContent>Fictional body copy for Harbor Notes.</CardContent>
      <CardFooter>
        <span>Updated today</span>
      </CardFooter>
    </Card>
    <Card variant="flat">
      <CardHeader>
        <CardTitle level={3}>Flat card</CardTitle>
        <CardDescription>Border only, no shadow.</CardDescription>
      </CardHeader>
      <CardContent>Useful inside dense dashboards.</CardContent>
    </Card>
  </CardGrid>

  <h3>Media + clickable</h3>
  <div dir="rtl">
    <Card
      href="https://example.com/docs/cards"
      linkLabel="Clickable card Entire surface is one link (RTL demo)."
    >
      <CardMedia
        src="https://example.com/images/harbor.jpg"
        alt="Fictional harbor illustration"
      />
      <CardHeader>
        <CardTitle level={3}>Clickable card</CardTitle>
        <CardDescription>Entire surface is one link (RTL demo).</CardDescription>
      </CardHeader>
    </Card>
  </div>
</section>
