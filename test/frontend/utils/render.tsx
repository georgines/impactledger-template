import { MantineProvider } from "@mantine/core";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";
import { WalletProvider } from "@/components/providers/WalletProvider";

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider>
      <WalletProvider>{children}</WalletProvider>
    </MantineProvider>
  );
}

function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export { renderWithProviders as render };
export * from "@testing-library/react";
