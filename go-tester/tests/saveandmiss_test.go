package tests

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"tester/student/piscine"
)

type caseSM struct {
	Arg  string `json:"arg"`
	Num  int    `json:"num"`
	Want string `json:"want"`
}

func load(t *testing.T, fn string) []caseSM {
	t.Helper()
	b, err := os.ReadFile(fn)
	if err != nil { t.Fatalf("read %s: %v", fn, err) }
	var cs []caseSM
	if err := json.Unmarshal(b, &cs); err != nil { t.Fatalf("unmarshal %s: %v", fn, err) }
	return cs
}

func TestSaveAndMiss(t *testing.T) {
	// Visible cases come from a host-mounted directory (no rebuild required)
	casesDir := os.Getenv("CASES_DIR")
	if casesDir == "" { casesDir = "tests/cases" } // fallback for local dev

	all := load(t, filepath.Join(casesDir, "saveandmiss.json"))

	// Hidden cases remain baked into the image
	if _, err := os.Stat(filepath.Join("tests","hidden","saveandmiss_hidden.json")); err == nil {
		more := load(t, filepath.Join("tests","hidden","saveandmiss_hidden.json"))
		all = append(all, more...)
	}

	for i, c := range all {
		c := c
		t.Run(fmt.Sprintf("case_%d", i), func(t *testing.T){
			got := piscine.SaveAndMiss(c.Arg, c.Num)
			if got != c.Want {
				t.Errorf("SaveAndMiss(%q,%d) = %q; want %q", c.Arg, c.Num, got, c.Want)
			}
		})
	}
}
