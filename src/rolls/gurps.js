/** GURPS 4e success roll: criticals and margin (Basic Set, p. 347–348). */
export function gurpsVerdict(total, skill) {
    const critSuccess = total <= 4 || (total === 5 && skill >= 15) || (total === 6 && skill >= 16);
    const critFailure = total === 18 || (total === 17 && skill <= 15) || total - skill >= 10;
    if (critSuccess) return 'Critical Success';
    if (critFailure) return 'Critical Failure';
    if (total >= 17) return 'Failure, 17+ always fails';
    return total <= skill ? `Success by ${skill - total}` : `Failure by ${total - skill}`;
}
