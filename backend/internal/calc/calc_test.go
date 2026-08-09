package calc

import "testing"

func TestAdd(t *testing.T) {
	tests := []struct {
		name string
		a, b float64
		want float64
	}{
		{name: "positives", a: 2, b: 3, want: 5},
		{name: "negative operand", a: 2, b: -3, want: -1},
		{name: "zero", a: 0, b: 0, want: 0},
		{name: "fractional", a: 0.5, b: 0.25, want: 0.75},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Add(tt.a, tt.b); got != tt.want {
				t.Errorf("Add(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}
