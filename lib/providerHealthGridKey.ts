type ProviderHealthLike = {
  provider?: string;
  key?: string;
  label?: string;
  name?: string;
  title?: string;
};

export function providerHealthGridKey(item: ProviderHealthLike, index: number): string {
  return [item.provider, item.key, item.label, item.name, item.title, index]
    .filter((part) => part !== undefined && part !== null && String(part).trim().length > 0)
    .map((part) => String(part).trim())
    .join(":");
}
