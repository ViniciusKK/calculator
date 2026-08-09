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
