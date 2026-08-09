// Package calc holds the calculator domain logic, independent of any transport.
package calc

import "errors"

var (
	ErrDivideByZero = errors.New("division by zero")
	ErrUnknownOp    = errors.New("unknown operation")
)

// Op is a supported binary operation.
type Op string

const (
	Add      Op = "add"
	Subtract Op = "subtract"
	Multiply Op = "multiply"
	Divide   Op = "divide"
)

// Apply evaluates "a op b".
func Apply(op Op, a, b float64) (float64, error) {
	switch op {
	case Add:
		return a + b, nil
	case Subtract:
		return a - b, nil
	case Multiply:
		return a * b, nil
	case Divide:
		if b == 0 {
			return 0, ErrDivideByZero
		}
		return a / b, nil
	default:
		return 0, ErrUnknownOp
	}
}
