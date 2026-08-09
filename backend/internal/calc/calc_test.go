package calc

import (
	"errors"
	"testing"
)

func TestApply(t *testing.T) {
	tests := []struct {
		name    string
		op      Op
		a, b    float64
		want    float64
		wantErr error
	}{
		{name: "add", op: Add, a: 2, b: 3, want: 5},
		{name: "add fractional", op: Add, a: 0.5, b: 0.25, want: 0.75},
		{name: "subtract", op: Subtract, a: 2, b: 3, want: -1},
		{name: "multiply", op: Multiply, a: 2, b: 3, want: 6},
		{name: "multiply by zero", op: Multiply, a: 2, b: 0, want: 0},
		{name: "divide", op: Divide, a: 6, b: 3, want: 2},
		{name: "divide by zero", op: Divide, a: 1, b: 0, wantErr: ErrDivideByZero},
		{name: "power", op: Power, a: 2, b: 10, want: 1024},
		{name: "power of zero exponent", op: Power, a: 7, b: 0, want: 1},
		{name: "power with negative exponent", op: Power, a: 2, b: -2, want: 0.25},
		{name: "power with fractional exponent", op: Power, a: 9, b: 0.5, want: 3},
		{name: "power of negative base", op: Power, a: -2, b: 3, want: -8},
		{name: "unknown op", op: Op("modulo"), a: 1, b: 2, wantErr: ErrUnknownOp},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Apply(tt.op, tt.a, tt.b)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Apply(%q, %v, %v) error = %v, want %v", tt.op, tt.a, tt.b, err, tt.wantErr)
			}
			if tt.wantErr == nil && got != tt.want {
				t.Errorf("Apply(%q, %v, %v) = %v, want %v", tt.op, tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestSqrt(t *testing.T) {
	tests := []struct {
		name    string
		a       float64
		want    float64
		wantErr error
	}{
		{name: "perfect square", a: 9, want: 3},
		{name: "zero", a: 0, want: 0},
		{name: "fractional", a: 0.25, want: 0.5},
		{name: "large", a: 1e8, want: 1e4},
		{name: "negative", a: -1, wantErr: ErrNegativeRoot},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Sqrt(tt.a)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Sqrt(%v) error = %v, want %v", tt.a, err, tt.wantErr)
			}
			if tt.wantErr == nil && got != tt.want {
				t.Errorf("Sqrt(%v) = %v, want %v", tt.a, got, tt.want)
			}
		})
	}
}
