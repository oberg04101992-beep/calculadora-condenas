import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import HowItWasCalculated from "../components/HowItWasCalculated";

describe("HowItWasCalculated", () => {
  it("no renderiza si no hay pasos (opción A)", () => {
    render(<HowItWasCalculated />);
    expect(screen.queryByTestId("howit-list")).not.toBeInTheDocument();
    expect(screen.queryByTestId("howit-summary")).not.toBeInTheDocument();
  });

  it("muestra listado cuando hay steps", () => {
    render(<HowItWasCalculated steps={[{ label: "Paso 1", value: "ok" }]} />);
    expect(screen.getByTestId("howit-list")).toBeInTheDocument();
    expect(screen.getByText(/Paso 1/)).toBeInTheDocument();
  });
});
