// Package calc holds the calculator domain logic, independent of any transport.
package calc

import (
	"errors"
	"math"
)

var (
	ErrDivideByZero = errors.New("division by zero")
	ErrNegativeRoot = errors.New("square root of a negative number")
	ErrUnknownOp    = errors.New("unknown operation")
)

// Op is a supported binary operation.
type Op string

const (
	Add      Op = "add"
	Subtract Op = "subtract"
	Multiply Op = "multiply"
	Divide   Op = "divide"
	Power    Op = "power"
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
	case Power:
		return math.Pow(a, b), nil
	default:
		return 0, ErrUnknownOp
	}
}

// Sqrt is the one unary operation; it gets its own entry point rather than a
// dummy second operand.
func Sqrt(a float64) (float64, error) {
	if a < 0 {
		return 0, ErrNegativeRoot
	}
	return math.Sqrt(a), nil
}
